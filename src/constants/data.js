export const EMISSION_FACTORS = {
  car: 0.18,      // kg CO2 per km
  bike: 0.005,    // kg CO2 per km
  bus: 0.08,      // kg CO2 per passenger km
  train: 0.04,    // kg CO2 per passenger km
  flight: 0.15,   // kg CO2 per passenger km
  electricity: 0.45, // kg CO2 per kWh
  gas: 2.0,       // kg CO2 per m3
  meat: 7.2,      // kg CO2 per average meat meal
  vegetarian: 2.1, // kg CO2 per vegetarian meal
  vegan: 1.2,     // kg CO2 per vegan meal
  waste: 0.5,     // kg CO2 per kg trash
  water: 0.298,   // kg CO2 per cubic meter
  shopping: 1.5,  // kg CO2 per purchasing unit
};

export const DEFAULT_CALC_DATA = {
  carDistance: 50,
  bikeDistance: 20,
  busDistance: 10,
  trainDistance: 5,
  flightDistance: 0,
  electricityUse: 15,
  gasUse: 2,
  dietType: 'meat', 
  wasteWeight: 3,
  waterVolume: 0.5,
  shoppingItems: 2
};

export const CHANNELS = [
  { 
    id: 'plastic', 
    title: 'No Plastic Week', 
    description: 'Avoid single-use plastic bottles, utensils, and bags for seven consecutive days.', 
    reward: 150, 
    category: 'Waste', 
    days: 7,
    subChallenges: [
      { id: 'p1', task: 'Carry a reusable steel water bottle all day', points: 30 },
      { id: 'p2', task: 'Say "no plastic bag" at the grocery checkout', points: 40 },
      { id: 'p3', task: 'Use bamboo or metal utensils for lunch', points: 40 },
      { id: 'p4', task: 'Avoid packaged snacks and choose fresh fruit', points: 40 }
    ]
  },
  { 
    id: 'bike', 
    title: 'Bike To Work Challenge', 
    description: 'Swap at least three car or taxi transits for carbon-free biking/walking trips.', 
    reward: 200, 
    category: 'Transportation', 
    days: 5,
    subChallenges: [
      { id: 'b1', task: 'Walk or bike for any trip under 2 km', points: 50 },
      { id: 'b2', task: 'Map out a safe cycling route to your destination', points: 40 },
      { id: 'b3', task: 'Complete a 15-minute morning brisk walk', points: 50 },
      { id: 'b4', task: 'Log your saved fuel mileage in the Impact Log', points: 60 }
    ]
  },
  { 
    id: 'green_energy', 
    title: 'Power-Down Protocols', 
    description: 'Reduce power consumption by switching off unused screens and lights by 9:00 PM daily.', 
    reward: 100, 
    category: 'Energy', 
    days: 3,
    subChallenges: [
      { id: 'e1', task: 'Unplug chargers and appliances on standby mode', points: 25 },
      { id: 'e2', task: 'Switch off all room lights during daylight hours', points: 25 },
      { id: 'e3', task: 'Turn off your laptop completely instead of sleeping it', points: 25 },
      { id: 'e4', task: 'Spend 1 hour screen-free before bed', points: 25 }
    ]
  },
  { 
    id: 'zero_waste', 
    title: 'Zero Scrap Meals', 
    description: 'Cook and finish 100% of your purchased food items to eliminate unnecessary food-rot trash.', 
    reward: 180, 
    category: 'Food', 
    days: 4,
    subChallenges: [
      { id: 'z1', task: 'Plan your exact meal ingredients before cooking', points: 45 },
      { id: 'z2', task: 'Compost organic kitchen vegetable scraps safely', points: 45 },
      { id: 'z3', task: 'Save and consume leftover portions for dinner', points: 45 },
      { id: 'z4', task: 'Measure grain sizes to prevent excess food waste', points: 45 }
    ]
  }
];

export const PRESET_ARTICLES = [
  {
    id: 'art-1',
    title: 'The Hidden Impact of Carbon Offsets',
    excerpt: 'Are tree-planting campaigns actually cooling the atmosphere? We look behind corporate advertising campaigns.',
    content: 'Carbon offsetting allows companies and individuals to invest in environmental projects around the world to balance out their own carbon footprints. However, the science is complex. Tree survival rates, baseline accuracy, and long-term land security play crucial roles in deciding if an offset is truly cooling the atmosphere or simply serving as corporate greenwashing.',
    category: 'Education',
    readingTime: '5 min'
  },
  {
    id: 'art-2',
    title: 'Transitioning to Residential Heat Pumps',
    excerpt: 'How swapping natural gas for geothermal or air-source pumps saves over 4 tons of domestic CO2 annually.',
    content: 'Heat pumps are three to four times more energy-efficient than traditional electrical heaters and emit zero fossil-fuel greenhouse gases locally. By using atmospheric temperature gradients, they transfer thermal energy rather than generating it directly via combustion, offering an exceptional blueprint for fully decarbonizing the residential sector.',
    category: 'Energy',
    readingTime: '7 min'
  },
  {
    id: 'art-3',
    title: 'Decarbonizing Our Plates: Vegan vs. Local Meat',
    excerpt: 'Is eating a local steak more planet-positive than importing vegetables from across the oceans? The math is clear.',
    content: 'Many believe that sourcing animal products locally reduces trans-oceanic food-mile emissions sufficiently to beat global logistics. Yet research reveals agricultural greenhouse emissions (like bovine enteric fermentation and feed development) dwarf delivery emissions by nearly 10 to 1. Choosing vegetable proteins, even globally transported, consistently registers far lower carbon indices.',
    category: 'Food',
    readingTime: '4 min'
  }
];