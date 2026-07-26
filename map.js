// Extended 8000px Level Blueprint Mapping
const levelObjects = [
    // --- ZONE 1: THE BASICS (0px - 2000px) ---
    { type: 'pillar', x: 300, width: 40, height: 40 },
    { type: 'battery', x: 310, height: 60 }, // On top of pillar 1
    
    { type: 'spike', x: 550, width: 30, height: 15 }, // NO battery here
    
    { type: 'pillar', x: 750, width: 40, height: 60 },
    { type: 'battery', x: 760, height: 80 }, // On top of pillar 2
    
    { type: 'platform', x: 1000, width: 150, height: 80 },
    { type: 'battery', x: 1050, height: 115 }, // On top of platform
    { type: 'battery', x: 1100, height: 115 }, // On top of platform
    
    { type: 'spike', x: 1300, width: 30, height: 15 },
    { type: 'pillar', x: 1600, width: 40, height: 50 },
    { type: 'spike', x: 1850, width: 30, height: 15 },

    // --- ZONE 2: PLATFORMING GAUNTLET (2000px - 4000px) ---
    { type: 'platform', x: 2100, width: 120, height: 90 },
    { type: 'battery', x: 2150, height: 125 },
    
    { type: 'pillar', x: 2400, width: 40, height: 90 },
    { type: 'spike', x: 2650, width: 30, height: 15 },
    
    { type: 'platform', x: 2800, width: 200, height: 100 },
    { type: 'battery', x: 2850, height: 135 },
    { type: 'battery', x: 2950, height: 135 },
    
    { type: 'spike', x: 3150, width: 30, height: 15 },
    
    { type: 'platform', x: 3300, width: 120, height: 85 },
    { type: 'pillar', x: 3600, width: 40, height: 60 },
    { type: 'battery', x: 3610, height: 80 },
    
    { type: 'spike', x: 3850, width: 30, height: 15 },

    // --- ZONE 3: THE DEEP CORE (4000px - 8000px) ---
    { type: 'pillar', x: 4100, width: 40, height: 70 },
    { type: 'battery', x: 4110, height: 95 },
    
    { type: 'spike', x: 4350, width: 30, height: 15 },
    
    { type: 'platform', x: 4500, width: 150, height: 110 },
    { type: 'battery', x: 4550, height: 145 },
    
    { type: 'pillar', x: 4900, width: 40, height: 50 },
    { type: 'spike', x: 5200, width: 30, height: 15 },
    
    { type: 'platform', x: 5500, width: 250, height: 90 },
    { type: 'battery', x: 5550, height: 125 },
    { type: 'battery', x: 5650, height: 125 },
    
    { type: 'pillar', x: 6000, width: 40, height: 80 },
    { type: 'spike', x: 6300, width: 30, height: 15 },
    
    { type: 'platform', x: 6600, width: 120, height: 120 },
    { type: 'battery', x: 6650, height: 155 },
    
    { type: 'pillar', x: 7100, width: 40, height: 60 },
    { type: 'spike', x: 7400, width: 30, height: 15 }
];
