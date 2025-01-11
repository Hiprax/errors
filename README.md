# Error Handler Package

A modular error handling solution for Express.js applications.

## Features

- Predefined HTTP error codes
- Custom error class
- Middleware for handling errors in production and development
- TypeScript support

## Installation

To use this component in your project, install it via npm:

```bash
npm install @hiprax/errors
```

## Usage

```ts
import {
  handler as ErrorHandler,
  middleware as errorMiddleware,
} from "@hiprax/errors";

app.use(errorMiddleware);

app.use((req, res, next) => {
  return next(new ErrorHandler("Something went wrong!", 500));
});
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Author

Developed by Hiprax.
