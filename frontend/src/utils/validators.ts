/**
 * Validate email format
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate phone number (E.164 format)
 */
export const isValidPhoneNumber = (phone: string): boolean => {
  // E.164 format: +[country code][number]
  const phoneRegex = /^\+[1-9]\d{1,14}$/;
  return phoneRegex.test(phone);
};

/**
 * Validate campaign name
 */
export const isValidCampaignName = (name: string): boolean => {
  return name.length >= 3 && name.length <= 100;
};

/**
 * Validate file type
 */
export const isValidFileType = (file: File, allowedTypes: string[]): boolean => {
  return allowedTypes.includes(file.type);
};

/**
 * Validate file size (in MB)
 */
export const isValidFileSize = (file: File, maxSizeMB: number): boolean => {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  return file.size <= maxSizeBytes;
};

/**
 * Validate audio file
 */
export const isValidAudioFile = (file: File): boolean => {
  const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/mp3'];
  const maxSizeMB = 10;
  return isValidFileType(file, allowedTypes) && isValidFileSize(file, maxSizeMB);
};

/**
 * Validate Excel/CSV file
 */
export const isValidContactFile = (file: File): boolean => {
  const allowedTypes = [
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
  ];
  const maxSizeMB = 50;
  return isValidFileType(file, allowedTypes) && isValidFileSize(file, maxSizeMB);
};
