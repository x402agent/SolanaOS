# Profile Edit Drawer

This directory contains components for editing user profile information.

## Components

### ProfileEditDrawer
A comprehensive drawer component that provides a form interface for users to edit their profile information:

**Features:**
- Edit profile picture and cover image
- Update display name and username
- Modify bio and description
- Update social media links
- Configure profile settings and preferences
- Form validation and error handling

## Styling

Styling for these components can be found in:
- `ProfileEditDrawer.styles.ts`: Contains all styles for the edit drawer

## Usage

```typescript
import { ProfileEditDrawer } from '@core/profile';
import { useState } from 'react';

function ProfileScreen() {
  const [isEditOpen, setIsEditOpen] = useState(false);
  
  return (
    <>
      <Button onPress={() => setIsEditOpen(true)}>
        Edit Profile
      </Button>
      
      <ProfileEditDrawer 
        isVisible={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        onSave={(updatedProfile) => {
          // Handle save logic
          setIsEditOpen(false);
        }}
      />
    </>
  );
}
```

## Form Validation

The drawer includes built-in validation for:
- Required fields
- Character limits
- Image dimensions and file sizes
- Username format and availability 