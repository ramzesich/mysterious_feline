// Scarcity Map Design - Only 1 highly critical battery exists!
const levelObjects = [
    // Zone 1
    { type: 'pillar', x: 300, width: 40, height: 40 },
    { type: 'spike', x: 550, width: 30, height: 15 },
    { type: 'pillar', x: 750, width: 40, height: 60 },
    { type: 'platform', x: 1000, width: 150, height: 80 },
    { type: 'spike', x: 1300, width: 30, height: 15 },
    { type: 'pillar', x: 1600, width: 40, height: 50 },
    { type: 'spike', x: 1850, width: 30, height: 15 },

    // Zone 2 - THE ULTIMATE BATTERY CACHE
    { type: 'platform', x: 2100, width: 120, height: 90 },
    { type: 'battery', x: 2150, height: 115 }, // THE ONLY BATTERY IN THE ENTIRE GAME
    
    { type: 'pillar', x: 2400, width: 40, height: 90 },
    { type: 'spike', x: 2650, width: 30, height: 15 },
    { type: 'platform', x: 2800, width: 200, height: 100 },
    { type: 'spike', x: 3150, width: 30, height: 15 },
    { type: 'platform', x: 3300, width: 120, height: 85 },
    { type: 'pillar', x: 3600, width: 40, height: 60 },
    { type: 'spike', x: 3850, width: 30, height: 15 },

    // Zone 3
    { type: 'pillar', x: 4100, width: 40, height: 70 },
    { type: 'spike', x: 4350, width: 30, height: 15 },
    { type: 'platform', x: 4500, width: 150, height: 110 },
    { type: 'pillar', x: 4900, width: 40, height: 50 },
    { type: 'spike', x: 5200, width: 30, height: 15 },
    { type: 'platform', x: 5500, width: 250, height: 90 },
    { type: 'pillar', x: 6000, width: 40, height: 80 },
    { type: 'spike', x: 6300, width: 30, height: 15 },
    { type: 'platform', x: 6600, width: 120, height: 120 },
    { type: 'pillar', x: 7100, width: 40, height: 60 },
    { type: 'spike', x: 7400, width: 30, height: 15 }
];
