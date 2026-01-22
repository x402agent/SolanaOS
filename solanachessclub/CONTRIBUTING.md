# Contributing to Solana App Kit

We love your input! We want to make contributing to Solana App Kit as easy and transparent as possible, whether it's:

- Reporting a bug  
- Discussing the current state of the code  
- Submitting a fix  
- Proposing new features  
- Becoming a maintainer  

**IMPORTANT**: We are currently only accepting _module_ contributions.  
Please see the **Acceptable Contributions** section below for details.

---

## Table of Contents

- [Development Process](#development-process)  
- [Acceptable Contributions](#acceptable-contributions)  
- [Project Structure and Module Organization](#project-structure-and-module-organization)  
- [Code Style Guidelines](#code-style-guidelines)  
  - [TypeScript](#typescript)  
  - [React Components](#react-components)  
  - [File Organization](#file-organization)  
  - [Documentation](#documentation)  
  - [Testing](#testing)  
- [Pull Request Process](#pull-request-process)  
- [Issue Reporting](#issue-reporting)  
  - [Bug Reports](#bug-reports)  
  - [Feature Requests](#feature-requests)  
- [Community](#community)  
- [License](#license)  

---

## Development Process

We use GitHub to host code, track issues and feature requests, and accept pull requests.

Steps to Contribute:

1. Fork the repository and create your branch from `main`.  
2. Add your module code (see ["Acceptable Contributions"](#acceptable-contributions) and ["Project Structure and Module Organization"](#project-structure-and-module-organization)).  
3. Add tests for any new or modified functionality.  
4. Ensure the test suite passes and your code lints.  
5. Update the documentation if APIs or interfaces have changed.  
6. Open a Pull Request for review.

---

## Acceptable Contributions

We are only accepting _module_ contributions at this time. A module is a self-contained feature set that follows our structure guidelines. Your contribution should be organized as follows:

- **Screens**: Place any new user-facing flows or sample screens in:  
  `screens/common/<module_folder>`

- **Components**: Place all reusable UI components in:  
  `src/components/<module_name>`

- **Services**: Place your business logic or API call code in:  
  `src/services/<module_name>`

- **Utilities**: Place any helper or utility functions in:  
  `src/utils/<module_name>`

- **Server-side Code (if needed)**:
  - **Controllers** go in `server/src/controllers`
  - **Routes** go in `server/src/routes`
  - **Business logic** (non-UI, purely server code) goes in `server/src/service`
  - **Utilities** go in `server/src/utils`

- **Redux State**: If your module requires custom Redux state, add or update slices in:  
  `src/state/<feature>`

All new contributions must be coherent, self-contained modules that align with our goal:  
"_A React Native open source library for web3 integrations that is easily customizable and modular._"

---

## Project Structure and Module Organization

**Key Folders**:

```
android/            -> React Native Android configuration
ios/                -> React Native iOS configuration
server/             -> Express.js server (optional APIs)
  src/controllers/  -> Server controllers
  src/routes/       -> Express route definitions
  src/service/      -> Server business logic
  src/utils/        -> Server-side utilities
src/
  components/       -> Reusable UI components
  services/         -> Client-side business logic or API calls
  utils/            -> Client-side utility functions
  state/            -> Redux slices and store configuration
  screens/          -> Sample screens and flows
docs/               -> Documentation
```

### Creating a New Module

1. In `screens/common/`, create a folder named after your module (e.g. `screens/common/myNewModule`) if you need to add example flows.  
2. In `src/components/`, create a folder with the same name (e.g. `src/components/myNewModule`) and add all related UI components.  
3. In `src/services/`, create a folder (e.g. `src/services/myNewModule`) for any business logic or API integration.  
4. In `src/utils/`, create a folder (e.g. `src/utils/myNewModule`) for helper functions.  
5. If your module requires server support, add code in:  
   - **Controllers**: `server/src/controllers/myNewModuleController.ts`  
   - **Routes**: `server/src/routes/myNewModule.ts`  
   - **Business Logic**: `server/src/service/myNewModule`  
   - **Utilities**: `server/src/utils/myNewModule`  
6. If your module requires new Redux state, create or update slices in `src/state/<feature>`.

Following this structure keeps the codebase organized and your module self-contained.

---

## Code Style Guidelines

### TypeScript

- Use TypeScript for all new code.  
- Define interfaces for component props and state.  
- Use proper type annotations and avoid `any`.  
- Use meaningful names for interfaces, types, and classes.  
- Document your types with inline comments or TSDoc.

```ts
// Good
interface Props {
  name: string;
  age?: number;
}
```

```ts
// Bad
const Component = (props: any) => {
  // ...
};
```

### React Components

- Use functional components with hooks.  
- Ensure components are reusable, customizable, and modular (plug-and-play).  
- Always create a separate styles file (e.g. `MyComponent.style.ts`).  
- Allow style overrides by accepting props like `style`, `containerStyle`, or `styleOverrides`.

```tsx
// Good
const MyButton: React.FC<MyButtonProps> = ({ onPress, label, styleOverrides }) => {
  const mergedStyles = { ...defaultStyles, ...styleOverrides };
  return (
    <TouchableOpacity onPress={onPress} style={mergedStyles.button}>
      <Text>{label}</Text>
    </TouchableOpacity>
  );
};
```

```tsx
// Bad
function MyButton(props) {
  return <TouchableOpacity style={{ padding: 10, backgroundColor: 'blue' }} />;
}
```

### File Organization

- One component per file with a **PascalCase** filename.  
- Place styles in a separate file named `ComponentName.style.ts`.  
- Place types in a file named `ComponentName.types.ts` if needed.  
- Group related files together in directories.

**Example structure**:

```
src/components/MyModule
 ├─ MyModuleMain.tsx
 ├─ MyModuleMain.style.ts
 └─ MyModuleSubComponent/
     ├─ MyModuleSubComponent.tsx
     ├─ MyModuleSubComponent.style.ts
     └─ MyModuleSubComponent.types.ts
```

### Documentation

- Use JSDoc or TSDoc comments for all components, functions, and major interfaces.  
- Include usage examples.  
- Clearly document props and return types.  
- Provide implementation notes or warnings for edge cases.

```ts
/**
 * A reusable button component that supports custom styling.
 * @component
 * @example
 * <MyButton onPress={handlePress} label="Click Me" styleOverrides={myStyles} />
 */
```

### Testing

- Write unit tests for all new functionality.  
- Use React Testing Library for component tests.  
- Test component behavior rather than implementation details.  
- Mock external dependencies to isolate tests.  
- Cover edge cases and error states.

```ts
import { render, fireEvent } from '@testing-library/react-native';
import MyButton from './MyButton';

describe('MyButton', () => {
  it('should call onPress when pressed', () => {
    const onPressMock = jest.fn();
    const { getByText } = render(<MyButton onPress={onPressMock} label="Tap" />);
    fireEvent.press(getByText('Tap'));
    expect(onPressMock).toHaveBeenCalled();
  });
});
```

---

## Pull Request Process

1. Fork the repo and create a branch from `main`.  
2. Implement your module following the guidelines in ["Acceptable Contributions"](#acceptable-contributions) and ["Project Structure and Module Organization"](#project-structure-and-module-organization).  
3. Add tests for any changes or new features.  
4. Update documentation and the README as needed.  
5. Open a Pull Request describing your changes and referencing any relevant issues.  
6. Wait for review and sign-off from at least one other developer before merging.

---

## Issue Reporting

### Bug Reports

When filing an issue, please provide:

1. Version of the library you’re using.  
2. Steps to reproduce the bug.  
3. Expected vs. actual results.  
4. Any error messages or logs.

### Feature Requests

For feature requests, please include:

1. A clear description of the feature.  
2. Use cases and benefits for developers.  
3. A potential implementation approach.

---

## Community

- Be welcoming to newcomers.  
- Be respectful of differing viewpoints.  
- Accept constructive criticism.  
- Focus on what is best for the community.  

---

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

If you have any questions or need clarification, please open an issue or reach out to the maintainers. We appreciate every effort to improve Solana Social Starter and look forward to building a robust community library together!
