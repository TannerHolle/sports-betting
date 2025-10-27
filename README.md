# College Football Scoreboard

A modern Vue.js application that displays live college football scores from the ESPN API.

## Features

- 🏈 Real-time college football scores
- 📱 Responsive design for all devices
- 🎨 Modern, clean UI with glassmorphism effects
- ⚡ Fast loading with Vue 3 Composition API
- 🔄 Auto-refresh functionality
- 📊 Detailed game information including:
  - Team logos and records
  - Live scores and quarter-by-quarter breakdown
  - Game status (scheduled, in-progress, completed)
  - Current game situation (down, distance, possession)
  - Last play information
  - Direct links to ESPN game pages

## Getting Started

### Prerequisites

- Node.js (version 16 or higher)
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser and navigate to `http://localhost:3000`

### Building for Production

```bash
npm run build
```

## API

This app fetches data from the ESPN College Football API:
- **Endpoint**: `https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard`
- **Data**: Live scores, team information, game status, and more

## Project Structure

```
src/
├── App.vue              # Main application component
├── main.js              # Application entry point
├── style.css            # Global styles
└── components/
    └── GameCard.vue     # Individual game display component
```

## Technologies Used

- **Vue 3** - Progressive JavaScript framework
- **Vite** - Fast build tool and dev server
- **Axios** - HTTP client for API requests
- **CSS3** - Modern styling with flexbox and grid
- **ESPN API** - Sports data source

## Features in Detail

### Game Cards
Each game is displayed in a beautiful card showing:
- Team names, logos, and records
- Current scores and quarter scores
- Game status with live clock
- Venue and broadcast information
- Current game situation (down, distance, possession)
- Last play information for live games
- Direct links to ESPN game pages

### Responsive Design
- Mobile-first approach
- Adaptive grid layout
- Touch-friendly interface
- Optimized for all screen sizes

### Error Handling
- Graceful error states
- Retry functionality
- Loading indicators
- User-friendly error messages

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## License

MIT License - feel free to use this project for your own purposes.
