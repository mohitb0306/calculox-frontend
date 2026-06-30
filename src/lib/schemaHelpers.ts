// Calculox_Frontend/src/lib/schemaHelpers.ts

/**
 * 0. Universal Setting Extractor
 * Safely extracts settings from either an array of objects or a key-value object.
 */
export const getSetting = (settingsData: any, keys: string[], fallback: string = ""): any => {
  if (!settingsData) return fallback;
  if (Array.isArray(settingsData)) {
    for (const key of keys) {
       const row = settingsData.find((s: any) => s.setting_key === key || s.key === key);
       if (row && (row.setting_value !== undefined || row.value !== undefined)) {
           return row.setting_value || row.value;
       }
    }
  } else if (typeof settingsData === 'object') {
    for (const key of keys) {
       if (settingsData[key] !== undefined && settingsData[key] !== null) {
           return settingsData[key];
       }
    }
  }
  return fallback;
};

/**
 * 1. URL Normalizer
 * Ensures absolute URLs with proper protocols and no trailing slashes.
 */
export const getCanonicalUrl = (url: string): string => {
  if (!url) return "";
  let cleanUrl = url.trim();
  if (!cleanUrl.startsWith('http') && !cleanUrl.includes('localhost')) {
      cleanUrl = `https://${cleanUrl}`;
  } else if (!cleanUrl.startsWith('http')) {
      cleanUrl = `http://${cleanUrl}`;
  }
  
  if (process.env.NODE_ENV === 'production' && cleanUrl.startsWith('http:') && !cleanUrl.includes('localhost')) {
      cleanUrl = cleanUrl.replace('http:', 'https:');
  }
  
  return cleanUrl.replace(/\/$/, "");
};

/**
 * 2. Strict Social URL Normalizer
 * Enforces correct platform domains for social profiles.
 */
export const normalizeSocialUrl = (url: string | undefined, platformBase: string = ""): string | null => {
  if (!url || url.trim() === "") return null;
  let cleanUrl = url.trim();
  if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) return cleanUrl;
  
  if (cleanUrl.includes('.com') || cleanUrl.includes('.org') || cleanUrl.includes('.net') || cleanUrl.includes('.in')) {
      return `https://${cleanUrl}`;
  }
  
  if (platformBase !== "") {
      return `${platformBase}${cleanUrl.replace(/^@/, '')}`;
  }
  
  return `https://${cleanUrl}`; 
};

/**
 * 3. Bulletproof Mathematical Date Formatter
 * Solves the UTC/IST Conversion Bug by calculating precise local offsets.
 */
export const formatIsoDateWithOffset = (dateStr?: string, timeZoneStr?: string): string | undefined => {
  if (!dateStr) return undefined;
  try {
    let safeDateStr = dateStr.includes(' ') ? dateStr.replace(' ', 'T') : dateStr;
    if (!safeDateStr.includes('Z') && !/[+-]\d{2}:\d{2}$/.test(safeDateStr)) {
        safeDateStr += 'Z';
    }
    
    const dateObj = new Date(safeDateStr);
    if (isNaN(dateObj.getTime())) return undefined;
    let timeZone = timeZoneStr || 'UTC';
    let finalOutput = '';

    const explicitMatch = timeZone.match(/([+-])(\d{1,2}):(\d{2})/);
    if (explicitMatch) {
        const sign = explicitMatch[1] === '+' ? 1 : -1;
        const hours = parseInt(explicitMatch[2], 10);
        const mins = parseInt(explicitMatch[3], 10);
        const totalOffsetMinutes = sign * ((hours * 60) + mins);
        const localDate = new Date(dateObj.getTime() + (totalOffsetMinutes * 60000));
        const fmt = (num: number) => num.toString().padStart(2, '0');
        const localIso = `${localDate.getUTCFullYear()}-${fmt(localDate.getUTCMonth()+1)}-${fmt(localDate.getUTCDate())}T${fmt(localDate.getUTCHours())}:${fmt(localDate.getUTCMinutes())}:${fmt(localDate.getUTCSeconds())}`;
        
        const offsetStr = `${explicitMatch[1]}${fmt(hours)}:${fmt(mins)}`;
        finalOutput = `${localIso}${offsetStr}`;
    } else {
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: timeZone,
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
            timeZoneName: 'shortOffset'
        });
        const parts = formatter.formatToParts(dateObj);
        const p: any = {};
        parts.forEach(part => p[part.type] = part.value);
        
        let offset = '+00:00';
        if (p.timeZoneName && p.timeZoneName !== 'GMT') {
            let extracted = p.timeZoneName.replace('GMT', '');
            if (extracted === '') {
                offset = '+00:00';
            } else {
                const offsetSign = extracted.charAt(0);
                let [h, m] = extracted.substring(1).split(':');
                h = h.padStart(2, '0');
                m = m || '00';
                offset = `${offsetSign}${h}:${m}`;
            }
        }
        
        let hr = p.hour === '24' ? '00' : p.hour;
        finalOutput = `${p.year}-${p.month}-${p.day}T${hr}:${p.minute}:${p.second}${offset}`;
    }

    return finalOutput;
  } catch (e) {
    return undefined;
  }
};

/**
 * 4. Recursive Schema Hydration Engine
 * Prevents JSON parsing vulnerabilities and preserves strict datatypes (Numbers vs Strings)
 * by recursively mapping variables across multidimensional JSON-LD schema objects.
 */
export const hydrateSchemaObject = (obj: any, replacementVars: Record<string, any>): any => {
  // Base case: String replacement
  if (typeof obj === 'string') {
      let res = obj;
      // 1. Direct match check to preserve Number/Boolean types exactly
      for (const [key, value] of Object.entries(replacementVars)) {
          if (res === `%${key}%`) return value;
      }
      // 2. Inline string replacements for combined URLs/Text
      for (const [key, value] of Object.entries(replacementVars)) {
          if (res.includes(`%${key}%`)) {
              res = res.replace(new RegExp(`%${key}%`, 'g'), String(value));
          }
      }
      return res;
  }
  // Base case: Array traversal
  if (Array.isArray(obj)) {
      return obj.map(item => hydrateSchemaObject(item, replacementVars));
  }
  // Base case: Object traversal
  if (obj !== null && typeof obj === 'object') {
      const newObj: any = {};
      for (const [k, v] of Object.entries(obj)) {
          newObj[k] = hydrateSchemaObject(v, replacementVars);
      }
      return newObj;
  }
  
  return obj; // Fallback for native numbers/booleans already in the schema
};