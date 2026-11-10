import { ShopConfig, Order } from '../types';
import { isStoreOpenNow } from '../services/api';

/**
 * Odia digit conversion helper
 */
export function toOdiaDigits(num: string | number): string {
  const odiaDigits = ['୦', '୧', '୨', '୩', '୪', '୫', '୬', '୭', '୮', '୯'];
  return String(num).replace(/[0-9]/g, (d) => odiaDigits[parseInt(d, 10)]);
}

/**
 * Parse time string like "08:00", "8:30 AM", "10:00", "9:00 PM"
 */
export function parseTimeString(
  timeStr?: string,
  defaultHour = 8,
  defaultMinute = 0
): { hours: number; minutes: number } {
  if (!timeStr || !timeStr.trim()) {
    return { hours: defaultHour, minutes: defaultMinute };
  }
  const clean = timeStr.trim();
  const match12 = clean.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (match12) {
    let h = parseInt(match12[1], 10);
    const m = parseInt(match12[2], 10);
    const meridian = match12[3]?.toUpperCase();
    if (meridian === 'PM' && h < 12) h += 12;
    if (meridian === 'AM' && h === 12) h = 0;
    return {
      hours: Math.max(0, Math.min(23, h)),
      minutes: Math.max(0, Math.min(59, m))
    };
  }
  const match24 = clean.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    return {
      hours: Math.max(0, Math.min(23, parseInt(match24[1], 10))),
      minutes: Math.max(0, Math.min(59, parseInt(match24[2], 10)))
    };
  }
  return { hours: defaultHour, minutes: defaultMinute };
}

/**
 * Parse slot duration text to minutes
 * e.g. "30 min" -> 30, "1 hour" -> 60, "2 hours" -> 120
 */
export function parseSlotToMinutes(slotStr?: string): number {
  if (!slotStr || !slotStr.trim()) return 60;
  const str = slotStr.trim().toLowerCase();

  // Test hour pattern
  const hrMatch = str.match(/(\d+(\.\d+)?)\s*(h|hr|hrs|hour|hours)/);
  if (hrMatch) {
    return Math.round(parseFloat(hrMatch[1]) * 60);
  }

  // Test minute pattern
  const minMatch = str.match(/(\d+)\s*(m|min|mins|minute|minutes)/);
  if (minMatch) {
    return parseInt(minMatch[1], 10);
  }

  // Bare number
  const numMatch = str.match(/^(\d+)$/);
  if (numMatch) {
    return parseInt(numMatch[1], 10);
  }

  return 60;
}

/**
 * Format a Date object into human-readable 12-hour format
 * e.g. "8:30 AM"
 */
export function formatTime12(date: Date): string {
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const meridian = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) hours = 12;
  const mStr = minutes < 10 ? `0${minutes}` : `${minutes}`;
  return `${hours}:${mStr} ${meridian}`;
}

export function formatTimeOdia(date: Date): string {
  const time12 = formatTime12(date);
  const parts = time12.split(' ');
  const timeDigits = toOdiaDigits(parts[0]);
  const isMorning = date.getHours() < 12;
  const isNight = date.getHours() >= 19;
  const prefix = isNight ? 'ରାତି' : isMorning ? 'ସକାଳ' : 'ଅପରାହ୍ନ';
  return `${prefix} ${timeDigits} (${time12})`;
}

export interface PickupScheduleInfo {
  isStoreOpen: boolean;
  storeOpenTimeDisplay: string; // e.g. "08:00 AM"
  storeCloseTimeDisplay: string; // e.g. "09:00 PM"
  nextStoreOpenDate: Date;
  isTomorrow: boolean;
  dayLabelEn: string; // "Today" or "Tomorrow"
  dayLabelOd: string; // "ଆଜି" or "ଆସନ୍ତାକାଲି"
  slotMinutes: number;
  slotLabel: string;
  slotLabelOd: string;
  pickupFinalDate: Date;
  pickupFinalTimestamp: number;
  pickupFinalFormattedEn: string;
  pickupFinalFormattedOd: string;
  formulaDisplayEn: string;
  formulaDisplayOd: string;
  autoCancelGuaranteeEn: string;
  autoCancelGuaranteeOd: string;
}

/**
 * Main calculation function:
 * Calculates: selected slot + store open time = pickup final time
 * (when store is closed, syncs with next store opening time)
 */
export function calculatePickupSchedule(
  shopConfig: ShopConfig,
  selectedSlot: string = '30 min',
  referenceNow: Date = new Date()
): PickupScheduleInfo {
  const isOpen = isStoreOpenNow(shopConfig);

  const openTimeParsed = parseTimeString(shopConfig.storeOpenTime || '08:00', 8, 0);
  const closeTimeParsed = parseTimeString(shopConfig.storeCloseTime || '21:00', 21, 0);

  const slotMinutes = parseSlotToMinutes(selectedSlot);

  // Today open & close Date objects
  const todayOpen = new Date(
    referenceNow.getFullYear(),
    referenceNow.getMonth(),
    referenceNow.getDate(),
    openTimeParsed.hours,
    openTimeParsed.minutes,
    0,
    0
  );

  const todayClose = new Date(
    referenceNow.getFullYear(),
    referenceNow.getMonth(),
    referenceNow.getDate(),
    closeTimeParsed.hours,
    closeTimeParsed.minutes,
    0,
    0
  );

  let nextStoreOpenDate: Date;
  let isTomorrow = false;

  if (isOpen) {
    // When store is open right now, pickup starts from current time
    nextStoreOpenDate = new Date(referenceNow.getTime());
    isTomorrow = false;
  } else {
    // Store is closed
    if (referenceNow.getTime() < todayOpen.getTime()) {
      // Early morning before opening today
      nextStoreOpenDate = todayOpen;
      isTomorrow = false;
    } else {
      // Past closing time or store closed manually: next opening is tomorrow
      const tomorrow = new Date(
        referenceNow.getFullYear(),
        referenceNow.getMonth(),
        referenceNow.getDate() + 1,
        openTimeParsed.hours,
        openTimeParsed.minutes,
        0,
        0
      );
      nextStoreOpenDate = tomorrow;
      isTomorrow = true;
    }
  }

  // Calculate Pickup Final Time: Base (Store Open Time or Current Time) + selected slot
  const pickupFinalTimestamp = nextStoreOpenDate.getTime() + slotMinutes * 60 * 1000;
  const pickupFinalDate = new Date(pickupFinalTimestamp);

  const dayLabelEn = isTomorrow ? 'Tomorrow' : 'Today';
  const dayLabelOd = isTomorrow ? 'ଆସନ୍ତାକାଲି' : 'ଆଜି';

  // Format Open Time
  const storeOpenTimeDisplay = formatTime12(
    new Date(2026, 0, 1, openTimeParsed.hours, openTimeParsed.minutes)
  );
  const storeCloseTimeDisplay = formatTime12(
    new Date(2026, 0, 1, closeTimeParsed.hours, closeTimeParsed.minutes)
  );

  // Format slot labels
  let slotLabelOd = `${toOdiaDigits(slotMinutes)} ମିନିଟ୍`;
  if (slotMinutes >= 60 && slotMinutes % 60 === 0) {
    const hrs = slotMinutes / 60;
    slotLabelOd = `${toOdiaDigits(hrs)} ଘଣ୍ଟା`;
  }

  const pickupFinalFormattedEn = `${dayLabelEn}, ${formatTime12(pickupFinalDate)}`;
  const pickupFinalFormattedOd = `${dayLabelOd} ${formatTimeOdia(pickupFinalDate)}`;

  // Display formula: selected slot + store open time = pickup final time
  const openTimeForFormulaEn = isOpen
    ? `Now (${formatTime12(referenceNow)})`
    : `${dayLabelEn} ${storeOpenTimeDisplay}`;

  const openTimeForFormulaOd = isOpen
    ? `ବର୍ତ୍ତମାନ (${formatTime12(referenceNow)})`
    : `${dayLabelOd} ${toOdiaDigits(storeOpenTimeDisplay)}`;

  const formulaDisplayEn = `${selectedSlot} + Store Open (${openTimeForFormulaEn}) = Final Pickup: ${pickupFinalFormattedEn}`;
  const formulaDisplayOd = `ମନୋନୀତ ସ୍ଲଟ୍ (${slotLabelOd}) + ଦୋକାନ ଖୋଲିବା ସମୟ (${openTimeForFormulaOd}) = ଚୂଡ଼ାନ୍ତ ପିକଅପ୍ ସମୟ (${pickupFinalFormattedOd})`;

  const customCancelNotice = shopConfig.pickupCancelNotice && shopConfig.pickupCancelNotice.trim();
  const autoCancelGuaranteeEn = customCancelNotice
    ? `⚠️ ${customCancelNotice} (Deadline: ${pickupFinalFormattedEn})`
    : `⚠️ Auto-Cancel Notice: If not picked up by ${pickupFinalFormattedEn}, the order will automatically cancel and reserved stock will be immediately restored to shop inventory.`;
  const autoCancelGuaranteeOd = customCancelNotice
    ? `⚠️ ${customCancelNotice} (ଚୂଡ଼ାନ୍ତ ସମୟ: ${pickupFinalFormattedOd})`
    : `⚠️ ସ୍ୱୟଂକ୍ରିୟ ବାତିଲ୍ ଓ ଷ୍ଟକ୍ ସୁରକ୍ଷା: ଯଦି ଆପଣ ${pickupFinalFormattedOd} ମଧ୍ୟରେ ଅର୍ଡର ନନିଅନ୍ତି, ତେବେ ଅର୍ଡର ସ୍ୱୟଂକ୍ରିୟ ବାତିଲ୍ (Auto Cancel) ହେବ ଏବଂ ବୁକ୍ ଥିବା ଷ୍ଟକ୍ ତୁରନ୍ତ ଫେରାଇ ଦିଆଯିବ (Stock Restored)।`;

  return {
    isStoreOpen: isOpen,
    storeOpenTimeDisplay,
    storeCloseTimeDisplay,
    nextStoreOpenDate,
    isTomorrow,
    dayLabelEn,
    dayLabelOd,
    slotMinutes,
    slotLabel: selectedSlot,
    slotLabelOd,
    pickupFinalDate,
    pickupFinalTimestamp,
    pickupFinalFormattedEn,
    pickupFinalFormattedOd,
    formulaDisplayEn,
    formulaDisplayOd,
    autoCancelGuaranteeEn,
    autoCancelGuaranteeOd
  };
}

/**
 * Remaining time countdown helper
 */
export function getRemainingPickupTime(expiryTimestamp?: number): {
  isExpired: boolean;
  minutesLeft: number;
  secondsLeft: number;
  displayTextEn: string;
  displayTextOd: string;
} {
  if (!expiryTimestamp) {
    return {
      isExpired: false,
      minutesLeft: 0,
      secondsLeft: 0,
      displayTextEn: '',
      displayTextOd: ''
    };
  }

  const diffMs = expiryTimestamp - Date.now();
  if (diffMs <= 0) {
    return {
      isExpired: true,
      minutesLeft: 0,
      secondsLeft: 0,
      displayTextEn: 'Pickup time expired',
      displayTextOd: 'ପିକଅପ୍ ସମୟ ସମାପ୍ତ ହୋଇଛି'
    };
  }

  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  let textEn = '';
  let textOd = '';

  if (hours > 0) {
    textEn = `${hours}h ${minutes}m left`;
    textOd = `${toOdiaDigits(hours)} ଘଣ୍ଟା ${toOdiaDigits(minutes)} ମିନିଟ୍ ବାକି`;
  } else {
    textEn = `${minutes}m ${seconds}s left`;
    textOd = `${toOdiaDigits(minutes)} ମିନିଟ୍ ${toOdiaDigits(seconds)} ସେକେଣ୍ଡ ବାକି`;
  }

  return {
    isExpired: false,
    minutesLeft: Math.floor(totalSeconds / 60),
    secondsLeft: seconds,
    displayTextEn: textEn,
    displayTextOd: textOd
  };
}
