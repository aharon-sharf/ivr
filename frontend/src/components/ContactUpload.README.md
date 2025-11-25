# ContactUpload Component

## Overview

The `ContactUpload` component provides a drag-and-drop interface for uploading contact lists to campaigns. It supports Excel (.xlsx, .xls) and CSV (.csv) file formats with built-in validation, progress tracking, and detailed import summaries.

## Features

### 1. Drag-and-Drop File Upload
- Intuitive drag-and-drop interface
- Click to browse alternative
- Visual feedback during drag operations
- Single file upload at a time

### 2. File Validation
- **Supported formats**: Excel (.xlsx, .xls) and CSV (.csv)
- **Maximum file size**: 10MB
- **Validation checks**:
  - File extension validation
  - File size validation
  - Immediate feedback on validation errors

### 3. Upload Progress Indicator
- Real-time progress bar during upload
- Percentage completion display
- Visual feedback throughout the upload process

### 4. Import Summary
- **Total Records**: Number of records in the uploaded file
- **Successfully Imported**: Count of valid contacts added
- **Duplicates Removed**: Number of duplicate phone numbers merged
- **Validation Failures**: Count of invalid records
- **Error Details**: List of specific validation errors (up to 5 shown, with count of additional errors)

## Usage

### Basic Usage

```tsx
import { ContactUpload } from '../components/ContactUpload';

function MyPage() {
  const campaignId = 'campaign-123';

  const handleUploadComplete = (result: ImportResult) => {
    console.log('Upload complete:', result);
    // Handle successful upload (e.g., show notification, refresh data)
  };

  return (
    <ContactUpload
      campaignId={campaignId}
      onUploadComplete={handleUploadComplete}
    />
  );
}
```

### With Custom Handling

```tsx
import { ContactUpload } from '../components/ContactUpload';
import { ImportResult } from '../types';

function CampaignPage() {
  const campaignId = useParams().campaignId;

  const handleUploadComplete = (result: ImportResult) => {
    // Show success notification
    showNotification({
      type: 'success',
      message: `Successfully imported ${result.imported} contacts`,
    });

    // Refresh campaign data
    refetchCampaignData();

    // Navigate to campaign detail
    navigate(`/campaigns/${campaignId}`);
  };

  return (
    <ContactUpload
      campaignId={campaignId}
      onUploadComplete={handleUploadComplete}
    />
  );
}
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `campaignId` | `string` | Yes | The ID of the campaign to upload contacts to |
| `onUploadComplete` | `(result: ImportResult) => void` | No | Callback function called when upload completes successfully |

## ImportResult Type

```typescript
interface ImportResult {
  totalRecords: number;      // Total records in the file
  imported: number;           // Successfully imported contacts
  duplicates: number;         // Duplicate phone numbers removed
  failures: number;           // Validation failures
  errors: string[];           // Array of error messages
}
```

## File Format Requirements

### Excel Files (.xlsx, .xls)
- First row should contain column headers
- Required column: `phoneNumber` (E.164 format recommended)
- Optional columns: `name`, `email`, custom metadata fields
- Example:
  ```
  phoneNumber       | name          | email
  +972501234567    | John Doe      | john@example.com
  +972521234567    | Jane Smith    | jane@example.com
  ```

### CSV Files (.csv)
- Comma-separated values
- First row should contain column headers
- Same column requirements as Excel files
- Example:
  ```csv
  phoneNumber,name,email
  +972501234567,John Doe,john@example.com
  +972521234567,Jane Smith,jane@example.com
  ```

## Phone Number Format

Phone numbers should be in E.164 format:
- Start with `+` followed by country code
- No spaces, dashes, or parentheses
- Examples:
  - ✅ `+972501234567` (Israel)
  - ✅ `+12025551234` (USA)
  - ❌ `0501234567` (missing country code)
  - ❌ `+972-50-123-4567` (contains dashes)

## Error Handling

The component handles various error scenarios:

1. **Invalid File Type**: Shows error if file is not Excel or CSV
2. **File Too Large**: Shows error if file exceeds 10MB
3. **Upload Failure**: Displays API error message
4. **Validation Errors**: Shows detailed list of validation failures in import summary

## Styling

The component uses Material-UI (MUI) components and follows the application's theme. Key visual elements:

- **Drag-and-drop area**: Dashed border, hover effects
- **Progress bar**: Linear progress indicator with percentage
- **Import summary**: Card layout with color-coded metrics
  - Success: Green
  - Warnings: Orange
  - Errors: Red

## API Integration

The component uses the `contactsApi.uploadContactList()` method:

```typescript
// API call
const result = await contactsApi.uploadContactList(campaignId, file);

// Expected response
{
  success: true,
  data: {
    totalRecords: 100,
    imported: 95,
    duplicates: 3,
    failures: 2,
    errors: [
      "Row 5: Invalid phone number format",
      "Row 12: Missing required field 'phoneNumber'"
    ]
  }
}
```

## Accessibility

- Keyboard navigation support via react-dropzone
- ARIA labels for screen readers
- Clear visual feedback for all states
- Error messages are announced to screen readers

## Dependencies

- `react-dropzone`: Drag-and-drop functionality
- `@mui/material`: UI components
- `@mui/icons-material`: Icons
- `axios`: HTTP client (via apiClient)

## Related Components

- `ContactUploadPage`: Full page implementation with instructions
- `CampaignDetailPage`: Includes "Upload Contacts" button
