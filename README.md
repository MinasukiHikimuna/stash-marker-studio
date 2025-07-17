# Stash Marker Studio

This is a companion app for Stashapp. This makes working with markers and tags easier than Stashapp supports natively.

Stashapp contains mostly video scenes which can be tagged and have markers. Markers are essentially timed tags with a starting time an an optional ending time.

Stashapp is connected to using GraphQL API.

## Features

- Markers can be approved or rejected quickly
- Manually created markers are shown as pre-approved
- New markers can be created
- An existing marker can be split or duplicated
- Marker's start and end time can be adjusted
- Marker's primary tag can be changed
- Visual timeline showing all markers
- Zoom controls for detailed editing
- Color-coded markers by status

## Prerequisites

- Node.js 22+ and npm
- A running instance of Stashapp
- Stashapp API key

## Configuration

Copy the `.env.sample` file to `.env.local` and update the values according to your Stashapp instance configuration.

The API key must be set in the environment variables. This is used for authentication with your Stashapp instance.

## Getting Started

1. Clone the repository
2. Install dependencies:

```bash
npm install
# or
yarn install
# or
pnpm install
```

3. Configure your environment variables (see Configuration section above)

4. Run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Development

This project uses:

- Next.js 14 with App Router
- TypeScript for type safety
- Tailwind CSS for styling
- GraphQL for API communication

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

[Add your license here]
