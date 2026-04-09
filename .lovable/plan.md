

## Plan: Remove Upload Data and API Integration Tabs from Both Screens

Since Inward data auto-syncs every 5 minutes and Shop Floor fetches live from SAP, the manual Upload and API tabs are unnecessary on both screens.

### Changes

**1. `src/pages/InwardReport.tsx`**
- Remove the entire Tabs wrapper (lines 604-623) and show search content directly
- Delete Upload tab content block (lines 1087-1201)
- Delete API Integration tab content block (lines 1204-1390 approx)
- Remove `activeTab` state and change rendering to always show search view
- Remove unused state: `isUploading`, `uploadStatus`, `uploadMessage`, `parseResult`, `showPreview`, `previewFileName`
- Remove `fileInputRef`
- Clean up unused imports: `Upload`, `Database`, `FileUp`, `Loader2`, `XLSX`, `UploadPreviewModal`, `downloadCSVTemplate`, `validateParsedData`, `ParseResult`

**2. `src/pages/ShopFloorStockSelection.tsx`**
- Remove the Tabs wrapper (lines 383-398) and show search content directly
- Delete Upload tab content block (lines 663-725)
- Delete SAP API tab content block (lines 727-865 approx)
- Remove `activeTab` state
- Remove unused state: `uploadStatus`, `uploadMessage`, `parseResult`, `showPreview`, `previewFileName`, SAP config states, file upload handler
- Remove `fileInputRef`
- Clean up unused imports: `Upload`, `Database`, `FileUp`, `Download`, `Settings`, `XLSX`, `ShopFloorUploadPreview`, `SAPConfigDialog`, `downloadShopFloorCSVTemplate`, `validateShopFloorStockData`, `Tabs`, `TabsList`, `TabsTrigger`

Both pages will show only the search/results view with no tab navigation.

