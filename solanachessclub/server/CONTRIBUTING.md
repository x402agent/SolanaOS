# Contributing to Solana App Kit - Server

Thank you for your interest in contributing to the Solana App Kit! This guide will help you get started with the development process and ensure your contributions align with the project's standards.

## Contribution Process

### 1. Implement Protocol Functions
- Add new protocol functionality under the `src/service` directory
- Follow existing patterns and folder structure
- Ensure proper error handling and validation
- Write modular, reusable, and easily customizable code
- Document your functions with JSDoc comments

### 2. Create API Routes
- Implement new API endpoints under the `src/routes` directory
- Group related endpoints in a logical file structure
- Follow RESTful API design principles
- Implement proper request validation
- Use controllers for business logic

### 3. Testing
- Test all endpoints using Postman or similar API testing tools
- Create and save a Postman collection for your endpoints
- Verify error handling and edge cases
- Test performance with various input scenarios

### 4. Update Environment Configuration
- Add any new environment variables to the `.env.example` file
- Include comments explaining the purpose of each variable
- Do not commit actual values or credentials to version control

### 5. Integration with Frontend
You have two options for frontend integration:
- Integrate directly with the dummy component we've created for you
- Let us know if you'd prefer our team to handle the integration

## Code Style Guidelines

- Use TypeScript for all new code
- Follow functional programming patterns
- Use descriptive variable names
- Keep functions small and focused on a single task
- Avoid duplicate code through modularization
- Include proper TypeScript interfaces for all data structures

## Pull Request Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature-name`)
3. Commit your changes with descriptive commit messages
4. Push to your fork and submit a pull request
5. Include details about your changes and how to test them
6. Update documentation as needed

## Additional Resources

- Read the [README.md](./README.md) for project overview
- Explore the existing code structure to understand patterns and conventions
- Reach out to maintainers if you have any questions

We appreciate your contributions and look forward to your pull requests! 