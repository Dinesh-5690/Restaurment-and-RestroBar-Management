export type ReceiptElementKey = 'logo' | 'name' | 'address' | 'contact';
export type ReceiptAlignment = 'left' | 'center' | 'right';
export type ReceiptElementPosition = { x: number; y: number };

export const RECEIPT_HEADER_HEIGHT_PX = 160;

export interface PrintSettings {
  name: string;
  logoUrl: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postalCode: string;
  phone: string;
  email: string;
  receiptWidthMm: number;
  headerHeightPx: number;
  elementOrder: ReceiptElementKey[];
  elementAlignments: Record<ReceiptElementKey, ReceiptAlignment>;
  elementPositions: Record<ReceiptElementKey, ReceiptElementPosition>;
  logoSizePx: number;
}

export const PRINT_SETTINGS_STORAGE_KEY = 'restaurant_print_settings';

export const DEFAULT_ELEMENT_ORDER: ReceiptElementKey[] = ['logo', 'name', 'address', 'contact'];

export const DEFAULT_ELEMENT_ALIGNMENTS: Record<ReceiptElementKey, ReceiptAlignment> = {
  logo: 'left',
  name: 'center',
  address: 'center',
  contact: 'center',
};

export const DEFAULT_ELEMENT_POSITIONS: Record<ReceiptElementKey, ReceiptElementPosition> = {
  logo: { x: 5, y: 6 },
  name: { x: 50, y: 54 },
  address: { x: 50, y: 83 },
  contact: { x: 50, y: 115 },
};

export const DEFAULT_PRINT_SETTINGS: PrintSettings = {
  name: 'Your Restaurant',
  logoUrl: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  postalCode: '',
  phone: '',
  email: '',
  receiptWidthMm: 87,
  headerHeightPx: RECEIPT_HEADER_HEIGHT_PX,
  elementOrder: DEFAULT_ELEMENT_ORDER,
  elementAlignments: DEFAULT_ELEMENT_ALIGNMENTS,
  elementPositions: DEFAULT_ELEMENT_POSITIONS,
  logoSizePx: 40,
};

async function getPrintSettingsFromAPI(): Promise<PrintSettings | null> {
  try {
    // Dynamically import to avoid circular dependency
    const { printerSettingsApi } = await import('./api');
    const response = await printerSettingsApi.get();
    return response.data;
  } catch (error) {
    console.warn('Failed to fetch printer settings from API:', error);
    return null;
  }
}

async function getPrintSettingsFromStorage(): Promise<PrintSettings | null> {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = localStorage.getItem(PRINT_SETTINGS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PrintSettings>;

    // Backward compatibility: older versions stored y as percentage.
    // Convert to pixels once when headerHeightPx is missing.
    let normalizedPositions = parsed.elementPositions;
    if (parsed.headerHeightPx === undefined && parsed.elementPositions) {
      const baseHeaderHeight = RECEIPT_HEADER_HEIGHT_PX;
      normalizedPositions = {
        logo: {
          x: parsed.elementPositions.logo?.x ?? DEFAULT_ELEMENT_POSITIONS.logo.x,
          y: ((parsed.elementPositions.logo?.y ?? DEFAULT_ELEMENT_POSITIONS.logo.y) / 100) * baseHeaderHeight,
        },
        name: {
          x: parsed.elementPositions.name?.x ?? DEFAULT_ELEMENT_POSITIONS.name.x,
          y: ((parsed.elementPositions.name?.y ?? DEFAULT_ELEMENT_POSITIONS.name.y) / 100) * baseHeaderHeight,
        },
        address: {
          x: parsed.elementPositions.address?.x ?? DEFAULT_ELEMENT_POSITIONS.address.x,
          y: ((parsed.elementPositions.address?.y ?? DEFAULT_ELEMENT_POSITIONS.address.y) / 100) * baseHeaderHeight,
        },
        contact: {
          x: parsed.elementPositions.contact?.x ?? DEFAULT_ELEMENT_POSITIONS.contact.x,
          y: ((parsed.elementPositions.contact?.y ?? DEFAULT_ELEMENT_POSITIONS.contact.y) / 100) * baseHeaderHeight,
        },
      };
    }

    return {
      ...DEFAULT_PRINT_SETTINGS,
      ...parsed,
      elementPositions: {
        ...DEFAULT_ELEMENT_POSITIONS,
        ...normalizedPositions,
      },
    };
  } catch (error) {
    console.warn('Failed to parse printer settings from storage:', error);
    return null;
  }
}

// Synchronous fallback for backward compatibility
export function getPrintSettings(): PrintSettings {
  if (typeof window === 'undefined') {
    return DEFAULT_PRINT_SETTINGS;
  }

  try {
    const raw = localStorage.getItem(PRINT_SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_PRINT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<PrintSettings>;

    let normalizedPositions = parsed.elementPositions;
    if (parsed.headerHeightPx === undefined && parsed.elementPositions) {
      const baseHeaderHeight = RECEIPT_HEADER_HEIGHT_PX;
      normalizedPositions = {
        logo: {
          x: parsed.elementPositions.logo?.x ?? DEFAULT_ELEMENT_POSITIONS.logo.x,
          y: ((parsed.elementPositions.logo?.y ?? DEFAULT_ELEMENT_POSITIONS.logo.y) / 100) * baseHeaderHeight,
        },
        name: {
          x: parsed.elementPositions.name?.x ?? DEFAULT_ELEMENT_POSITIONS.name.x,
          y: ((parsed.elementPositions.name?.y ?? DEFAULT_ELEMENT_POSITIONS.name.y) / 100) * baseHeaderHeight,
        },
        address: {
          x: parsed.elementPositions.address?.x ?? DEFAULT_ELEMENT_POSITIONS.address.x,
          y: ((parsed.elementPositions.address?.y ?? DEFAULT_ELEMENT_POSITIONS.address.y) / 100) * baseHeaderHeight,
        },
        contact: {
          x: parsed.elementPositions.contact?.x ?? DEFAULT_ELEMENT_POSITIONS.contact.x,
          y: ((parsed.elementPositions.contact?.y ?? DEFAULT_ELEMENT_POSITIONS.contact.y) / 100) * baseHeaderHeight,
        },
      };
    }

    return {
      ...DEFAULT_PRINT_SETTINGS,
      ...parsed,
      elementPositions: {
        ...DEFAULT_ELEMENT_POSITIONS,
        ...normalizedPositions,
      },
    };
  } catch (error) {
    return DEFAULT_PRINT_SETTINGS;
  }
}

export async function getPrintSettingsAsync(options?: { prefer?: 'storage' | 'api' }): Promise<PrintSettings> {
  const prefer = options?.prefer ?? 'storage';

  if (prefer === 'api') {
    try {
      const apiSettings = await getPrintSettingsFromAPI();
      if (apiSettings) {
        if (typeof window !== 'undefined') {
          localStorage.setItem(PRINT_SETTINGS_STORAGE_KEY, JSON.stringify(apiSettings));
        }
        return apiSettings;
      }
    } catch (error) {
      console.warn('Error fetching print settings from API, falling back to localStorage');
    }

    const storageSettings = await getPrintSettingsFromStorage();
    if (storageSettings) {
      return storageSettings;
    }
    return DEFAULT_PRINT_SETTINGS;
  }

  const storageSettings = await getPrintSettingsFromStorage();
  if (storageSettings) {
    return storageSettings;
  }

  try {
    const apiSettings = await getPrintSettingsFromAPI();
    if (apiSettings) {
      return apiSettings;
    }
  } catch (error) {
    console.warn('Error fetching from API, falling back to localStorage');
  }

  return DEFAULT_PRINT_SETTINGS;
}

export async function savePrintSettings(settings: PrintSettings) {
  // Save immediately to localStorage so refresh keeps recent edits.
  if (typeof window !== 'undefined') {
    localStorage.setItem(PRINT_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  }

  // Save to API and do not swallow failures; caller should show error state.
  try {
    const { printerSettingsApi } = await import('./api');
    const response = await printerSettingsApi.update(settings);
    const saved = response?.data as PrintSettings | undefined;
    if (saved && typeof window !== 'undefined') {
      localStorage.setItem(PRINT_SETTINGS_STORAGE_KEY, JSON.stringify(saved));
    }
    return saved ?? settings;
  } catch (error) {
    console.warn('Failed to save printer settings to API:', error);
    throw error;
  }
}
