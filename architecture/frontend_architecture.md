# Front-End Architecture & Boilerplates

This document outlines the frontend setup including libraries, configurations, and core client integrations.

## 1. Core Technology Stack

- **Framework**: Vite + React + TypeScript
- **Styling**: Tailwind CSS v4 (with custom `@tailwindcss/vite` integration)
- **Routing**: `react-router-dom`
- **State Management**: `zustand`
- **Form Handling**: `react-hook-form` + `zod`
- **Local Cache & Offline Support**: `dexie` + `dexie-react-hooks`
- **HTTP Client**: `axios`
- **Icons**: `lucide-react`

---

## 2. Shared Infrastructure Boilerplates

### A. Custom Tailwind Configuration
Tailwind CSS v4 handles configuration directly via CSS variables or configuration plugins. For project-specific custom colors, we extend them inside the base stylesheet or a standard JS configuration:

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        kib: {
          slate: "#1e293b",
          emerald: "#059669",
          amber: "#d97706",
          crimson: "#dc2626",
          background: "#f8fafc"
        }
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"]
      }
    },
  },
  plugins: [],
}
```

### B. Cloudflare R2 Client (`src/lib/r2Client.ts`)

```typescript
import axios from 'axios';

/**
 * Handles secure, pre-signed URL processing for direct binary uploads to Cloudflare R2.
 * Bypasses sending heavy payloads through the core server architecture.
 */
export async function uploadAssetToR2(
  presignedUrl: string, 
  file: File, 
  onProgress: (progress: number) => void
): Promise<boolean> {
  try {
    const response = await axios.put(presignedUrl, file, {
      headers: {
        'Content-Type': file.type,
      },
      onUploadProgress: (progressEvent) => {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / (progressEvent.total ?? file.size)
        );
        onProgress(percentCompleted);
      }
    });
    return response.status === 200;
  } catch (error) {
    console.error('R2 Binary Target Upload Failure:', error);
    return false;
  }
}
```

### C. Mapbox Hook (`src/hooks/useMapbox.ts`)

```typescript
import { useEffect, useRef, useState } from 'react';

interface MapboxOptions {
  containerId: string;
  lng: number;
  lat: number;
  zoom: number;
}

/**
 * Custom hooks isolating Mapbox lifecycle bindings cleanly from presentation view layers.
 */
export function useMapbox({ containerId, lng, lat, zoom }: MapboxOptions) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const [mapInstance, setMapInstance] = useState<any>(null);

  useEffect(() => {
    if (mapInstance || !containerId) return;

    // Abstract map initialization placeholder structure
    const mockMap = {
      center: [lng, lat],
      zoom: zoom,
      remove: () => console.log('Map resources deallocated safely.')
    };
    
    setMapInstance(mockMap);

    return () => {
      if (mapInstance && typeof mapInstance.remove === 'function') {
        mapInstance.remove();
      }
    };
  }, [containerId, lng, lat, zoom]);

  return { mapContainerRef, mapInstance };
}
```
