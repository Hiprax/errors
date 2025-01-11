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
import express from "express";
import http from "http";
import { errorMiddleware, ErrorHandler } from "@hiprax/errors";

const app = express();
const server = http.createServer(app);

server.listen(3000, () => {
  console.log("Server is running on port 3000");
});

app.use((req, res, next) => {
  console.log("Request received");
  return next(new ErrorHandler("Something went wrong!", 500));
});

app.use(errorMiddleware);
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Author

Developed by Hiprax.
