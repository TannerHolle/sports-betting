# Odds API Integration

This document describes the integration of the Odds API for fetching real-time betting odds for NBA, NCAA Basketball, and NCAA Football games.

## Overview

The system fetches odds from the Odds API once per day when someone visits the site, stores them in a local database, and serves them to the frontend. This conservative approach minimizes API usage while providing up-to-date odds.

## API Key

- **API Key**: `324fa767679954cb844d0aef766a4f96`
- **Provider**: The Odds API (https://the-odds-api.com/)

## Backend Implementation

### Services

1. **`oddsService.js`** - Handles API calls to the Odds API
   - Fetches odds for NBA, NCAA Basketball, and NCAA Football
   - Processes and formats odds data
   - Maps sports to Odds API sport keys

2. **`oddsDatabase.js`** - Manages local odds storage
   - Stores odds in JSON file (`backend/data/odds.json`)
   - Checks if odds need updating (once per day)
   - Provides methods to retrieve odds by sport

3. **`oddsMiddleware.js`** - Middleware for automatic odds updating
   - Checks if odds need updating when someone visits
   - Fetches fresh odds if needed
   - Continues with cached data if API fails

### API Endpoints

- `GET /api/odds` - Get all odds for all sports
- `GET /api/odds/:sport` - Get odds for specific sport (nba, ncaa-basketball, ncaa-football)
- `GET /api/odds/last-update` - Get last update timestamp
- `POST /api/odds/force-update` - Force update odds (admin endpoint)

### Data Structure

Odds are stored with the following structure:
```json
{
  "lastUpdated": "2025-10-27T02:18:57.758Z",
  "odds": {
    "nba": [
      {
        "id": "game_id",
        "sport": "nba",
        "homeTeam": "Team Name",
        "awayTeam": "Team Name",
        "commenceTime": "2025-10-27T23:00:00Z",
        "odds": {
          "Team Name_moneyline": 135,
          "Team Name_spread": {"line": 3.5, "price": -115},
          "Over_total": {"line": 233.5, "price": -115},
          "Under_total": {"line": 233.5, "price": -115}
        },
        "lastUpdated": "2025-10-27T02:18:57.758Z"
      }
    ],
    "ncaa-basketball": [...],
    "ncaa-football": [...]
  }
}
```

## Frontend Implementation

### Services

1. **`oddsService.js`** - Frontend service for odds data
   - Fetches odds from backend API
   - Converts odds data to betting format
   - Handles team name matching

### Components Updated

- **`NBAGameCard.vue`** - Now uses real odds data
- **`CollegeBasketballCard.vue`** - Now uses real odds data  
- **`NCAAFootballCard.vue`** - Now uses real odds data

### Betting Format

The frontend converts Odds API data to the existing betting format:
- **Moneyline**: Direct odds values
- **Point Spread**: Line and price for each team
- **Total (Over/Under)**: Line and price for over/under

## Usage

1. **Automatic Updates**: Odds are automatically fetched when someone visits the site and the data is older than 1 day
2. **Manual Updates**: Use the force update endpoint to refresh odds immediately
3. **Frontend Integration**: Game cards automatically fetch and display odds when available

## API Usage Conservation

- Odds are only fetched once per day per sport
- Cached data is used for subsequent requests
- API calls are made only when someone visits the site
- Failed API calls fall back to cached data

## Dependencies

### Backend
- `axios` - For HTTP requests to Odds API

### Frontend
- No new dependencies (uses existing axios)

## Error Handling

- API failures fall back to cached data
- Missing odds data gracefully handled in frontend
- Team name matching handles variations
- Console logging for debugging

## Future Enhancements

- Add more sports (NFL, NHL, etc.)
- Implement odds comparison across bookmakers
- Add historical odds tracking
- Real-time odds updates for live games
- Odds movement alerts

